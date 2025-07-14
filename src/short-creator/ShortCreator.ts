import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";
import https from "https";
import http from "http";

import { Kokoro } from "./libraries/Kokoro";
import { Remotion } from "./libraries/Remotion";
import { Whisper } from "./libraries/Whisper";
import { FFMpeg } from "./libraries/FFmpeg";

import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
  MusicForVideo,
} from "../types/shorts";

export class ShortCreator {
  private queue: {
    script: string;
    config: RenderConfig;
    id: string;
    videoPath: string;
  }[] = [];
  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    private musicManager: MusicManager,
  ) {}

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public addToQueue(
    script: string,
    config: RenderConfig,
    videoPath: string,
  ): string {
    // todo add mutex lock
    const id = cuid();
    this.queue.push({
      script,
      config,
      id,
      videoPath,
    });
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { script, config, id, videoPath } = this.queue[0];
    logger.debug(
      { script, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, script, config, videoPath);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      logger.error(error, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    script: string,
    config: RenderConfig,
    videoPath: string,
  ): Promise<string> {
    logger.debug(
      {
        script,
        config,
      },
      "Creating short video",
    );
    const scenes: Scene[] = [];
    const tempFiles = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    const audio = await this.kokoro.generate(
      script,
      config.voice ?? "af_heart",
    );
    const { audioLength, audio: audioStream } = audio;

    const tempId = cuid();
    const tempWavFileName = `${tempId}.wav`;
    const tempMp3FileName = `${tempId}.mp3`;
    const tempVideoFileName = `${tempId}.mp4`;
    const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
    const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
    const tempVideoPath = path.join(
      this.config.tempDirPath,
      tempVideoFileName,
    );
    tempFiles.push(tempVideoPath);
    tempFiles.push(tempWavPath, tempMp3Path);

    await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
    const captions = await this.whisper.CreateCaption(tempWavPath);

    await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
    fs.copySync(videoPath, tempVideoPath);

    await this.ffmpeg.burnSubtitles(
      tempVideoPath,
      tempMp3Path,
      captions,
      this.getVideoPath(videoId),
    );

    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    return videoId;
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });
    return musicFiles[Math.floor(Math.random() * musicFiles.length)];
  }

  public ListAvailableMusicTags(): MusicTag[] {
    const tags = new Set<MusicTag>();
    this.musicManager.musicList().forEach((music) => {
      tags.add(music.mood as MusicTag);
    });
    return Array.from(tags.values());
  }

  public listAllVideos(): { id: string; status: VideoStatus }[] {
    const videos: { id: string; status: VideoStatus }[] = [];

    // Check if videos directory exists
    if (!fs.existsSync(this.config.videosDirPath)) {
      return videos;
    }

    // Read all files in the videos directory
    const files = fs.readdirSync(this.config.videosDirPath);

    // Filter for MP4 files and extract video IDs
    for (const file of files) {
      if (file.endsWith(".mp4")) {
        const videoId = file.replace(".mp4", "");

        let status: VideoStatus = "ready";
        const inQueue = this.queue.find((item) => item.id === videoId);
        if (inQueue) {
          status = "processing";
        }

        videos.push({ id: videoId, status });
      }
    }

    // Add videos that are in the queue but not yet rendered
    for (const queueItem of this.queue) {
      const existingVideo = videos.find((v) => v.id === queueItem.id);
      if (!existingVideo) {
        videos.push({ id: queueItem.id, status: "processing" });
      }
    }

    return videos;
  }

  public ListAvailableVoices(): string[] {
    return this.kokoro.listAvailableVoices();
  }
}
