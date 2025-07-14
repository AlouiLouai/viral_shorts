import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  InputAdornment,
} from "@mui/material";
import {
  RenderConfig,
  MusicMoodEnum,
  CaptionPositionEnum,
  VoiceEnum,
  OrientationEnum,
  MusicVolumeEnum,
} from "../../types/shorts";

const VideoCreator: React.FC = () => {
  const navigate = useNavigate();
  const [script, setScript] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [config, setConfig] = useState<RenderConfig>({
    paddingBack: 1500,
    music: MusicMoodEnum.chill,
    captionPosition: CaptionPositionEnum.bottom,
    captionBackgroundColor: "blue",
    voice: VoiceEnum.af_heart,
    orientation: OrientationEnum.portrait,
    musicVolume: MusicVolumeEnum.high,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceEnum[]>([]);
  const [musicTags, setMusicTags] = useState<MusicMoodEnum[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [voicesResponse, musicResponse] = await Promise.all([
          axios.get("/api/voices"),
          axios.get("/api/music-tags"),
        ]);

        setVoices(voicesResponse.data);
        setMusicTags(musicResponse.data);
      } catch (err) {
        console.error("Failed to fetch options:", err);
        setError(
          "Failed to load voices and music options. Please refresh the page.",
        );
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  

  const handleConfigChange = (field: keyof RenderConfig, value: any) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!videoFile) {
        setError("Please select a video file.");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("script", script);
      formData.append("config", JSON.stringify(config));

      const response = await axios.post("/api/short-video", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      navigate(`/video/${response.data.id}`);
    } catch (err) {
      setError("Failed to create video. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingOptions) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="md" mx="auto" py={4}>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Video
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <input
                accept="video/mp4"
                style={{ display: "none" }}
                id="video-upload-button"
                type="file"
                onChange={(e) => setVideoFile(e.target.files ? e.target.files[0] : null)}
              />
              <label htmlFor="video-upload-button">
                <Button variant="outlined" component="span">
                  {videoFile ? videoFile.name : "Upload Video (MP4)"}
                </Button>
              </label>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Script"
                multiline
                rows={10}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                required
              />
            </Grid>
          </Grid>
        </Paper>

        <Typography variant="h5" component="h2" gutterBottom>
          Video Configuration
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="End Screen Padding (ms)"
                value={config.paddingBack}
                onChange={(e) =>
                  handleConfigChange("paddingBack", parseInt(e.target.value))
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">ms</InputAdornment>
                  ),
                }}
                helperText="Duration to keep playing after narration ends"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Music Mood</InputLabel>
                <Select
                  value={config.music}
                  onChange={(e) => handleConfigChange("music", e.target.value)}
                  label="Music Mood"
                  required
                >
                  {Object.values(MusicMoodEnum).map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Caption Position</InputLabel>
                <Select
                  value={config.captionPosition}
                  onChange={(e) =>
                    handleConfigChange("captionPosition", e.target.value)
                  }
                  label="Caption Position"
                  required
                >
                  {Object.values(CaptionPositionEnum).map((position) => (
                    <MenuItem key={position} value={position}>
                      {position}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Caption Background Color"
                value={config.captionBackgroundColor}
                onChange={(e) =>
                  handleConfigChange("captionBackgroundColor", e.target.value)
                }
                helperText="Any valid CSS color (name, hex, rgba)"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Default Voice</InputLabel>
                <Select
                  value={config.voice}
                  onChange={(e) => handleConfigChange("voice", e.target.value)}
                  label="Default Voice"
                  required
                >
                  {Object.values(VoiceEnum).map((voice) => (
                    <MenuItem key={voice} value={voice}>
                      {voice}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Orientation</InputLabel>
                <Select
                  value={config.orientation}
                  onChange={(e) =>
                    handleConfigChange("orientation", e.target.value)
                  }
                  label="Orientation"
                  required
                >
                  {Object.values(OrientationEnum).map((orientation) => (
                    <MenuItem key={orientation} value={orientation}>
                      {orientation}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Volume of the background audio</InputLabel>
                <Select
                  value={config.musicVolume}
                  onChange={(e) =>
                    handleConfigChange("musicVolume", e.target.value)
                  }
                  label="Volume of the background audio"
                  required
                >
                  {Object.values(MusicVolumeEnum).map((voice) => (
                    <MenuItem key={voice} value={voice}>
                      {voice}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        <Box display="flex" justifyContent="center">
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={loading}
            sx={{ minWidth: 200 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Create Video"
            )}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default VideoCreator;
