import { Platform } from "react-native";
import {
  SELECT_OFFLINE_PODCAST,
  SAVE_PODCAST_OFFLINE,
  SAVE_PODCAST_OFFLINE_UPDATE,
  SAVE_PODCAST_OFFLINE_ERROR,
  DELETE_PODCAST_OFFLINE,
  DELETE_PODCAST_OFFLINE_ERROR
} from "./types";
import RNBackgroundDownloader from "react-native-background-downloader";
import { hasPath, pathOr } from "ramda";
var RNFS = require("react-native-fs");

const testMP3 = "http://www.hubharp.com/web_sound/BachGavotteShort.mp3";

const downloadPodcast = (dispatch, podcast) =>
  new Promise((resolve, reject) => {
    let audio_link = pathOr(false, ["audio_link"], podcast);

    if (!audio_link) {
      reject();
    } else {
      if (typeof audio_link === "string") {
        audio_link = audio_link.slice(0, audio_link.length - 11);
      } else {
        reject();
      }
    }

    console.log("TCL: podcast downloadPodcast", podcast);

    let taskMp3 = RNBackgroundDownloader.download({
      id: String(podcast.id),
      url: audio_link,
      // url: testMP3,
      destination:
        `${RNBackgroundDownloader.directories.documents}/` +
        String(podcast.id) +
        ".mp3"
    })
      .begin(expectedBytes => {
        console.log(`TCL Going to download ${expectedBytes} bytes!`);
      })
      .progress(percent => {
        // console.log("TCL: percent", percent);
        dispatch({
          type: SAVE_PODCAST_OFFLINE_UPDATE,
          podcast: podcast,
          key: "progress",
          value: String(Math.floor(percent * 100))
        });
      })
      .done(() => {
        // console.log("TCL: done");
        const path =
          `${RNBackgroundDownloader.directories.documents}/` +
          String(podcast.id) +
          ".mp3";
        dispatch({
          type: SAVE_PODCAST_OFFLINE_UPDATE,
          podcast: podcast,
          key: "path",
          value: Platform.OS === "ios" ? "file://" + path : path
        });
        resolve();
      })
      .error(error => {
        console.log("TCL :" + error);
        dispatch({
          type: SAVE_PODCAST_OFFLINE_ERROR,
          podcast
        });
        reject();
      });
  });

const downloadImage = (dispatch, podcast) =>
  new Promise((resolve, reject) => {
    if (!podcast.img_url) {
      reject();
    }

    console.log("TCL: podcast downloadImage", podcast);

    let task = RNBackgroundDownloader.download({
      id: String(podcast.id),
      url: podcast.img_url,
      destination:
        `${RNBackgroundDownloader.directories.documents}/` +
        String(podcast.id) +
        ".jpg"
    })
      .begin(expectedBytes => {
        console.log(`TCL Going to download ${expectedBytes} bytes!`);
      })
      .progress(percent => {
        // console.log(`TCL Downloaded: ${percent * 100}%`);
      })
      .done(() => {
        const path =
          `${RNBackgroundDownloader.directories.documents}/` +
          String(podcast.id) +
          ".jpg";
        console.log("TCL: downloadImage path", path);
        dispatch({
          type: SAVE_PODCAST_OFFLINE_UPDATE,
          podcast: podcast,
          key: "image_offline",
          value: "file://" + path
        });
        resolve();
      })
      .error(error => {
        console.log("TCL: " + error);
        dispatch({
          type: SAVE_PODCAST_OFFLINE_ERROR,
          podcast
        });
        reject();
      });
  });

const deleteFile = path =>
  new Promise((resolve, reject) => {
    RNFS.unlink(path)
      .then(resolve)
      .catch(reject);
  });

findPodcast = (data, id) => {
  return data.find(item => {
    return item.id == id;
  });
};

export const selectOfflinePodcast = podcast => {
  return {
    type: SELECT_OFFLINE_PODCAST,
    podcast
  };
};

export const savePodcastOffline = podcast => {
  return async (dispatch, getState) => {
    if (!hasPath(["id"], podcast)) {
      return dispatch({
        type: SAVE_PODCAST_OFFLINE_ERROR,
        podcast
      });
    } else {
      dispatch({
        type: SAVE_PODCAST_OFFLINE,
        podcast
      });
      await downloadImage(dispatch, podcast);
      await downloadPodcast(dispatch, podcast);
    }
  };
};

export const deletePodcastOffline = podcast => {
  if (hasPath(["path"], podcast)) {
    return async (dispatch, getState) => {
      try {
        await deleteFile(podcast.path);
        await deleteFile(podcast.image_offline);
        return dispatch({
          type: DELETE_PODCAST_OFFLINE,
          podcast
        });
      } catch (error) {
        console.log(error);
        return dispatch({
          type: DELETE_PODCAST_OFFLINE_ERROR
        });
      }
    };
  } else {
    return {
      type: DELETE_PODCAST_OFFLINE,
      podcast
    };
  }
};

export const updatePodcast = (id, key, value) => {
  return (dispatch, getState) =>
    dispatch({
      type: SAVE_PODCAST_OFFLINE_UPDATE,
      podcast: { id: Number(id) },
      key,
      value
    });
};

export const resumeDownload = () => {
  return async (dispatch, getState) => {
    let lostTasks = await RNBackgroundDownloader.checkForExistingDownloads();
    console.log(
      "TCL: OfflineScreen -> resumeDownloads -> lostTasks",
      lostTasks
    );
    for (let task of lostTasks) {
      console.log(`TCL: Task ${task.id} was found!`);
      console.log(`TCL: Task ` + JSON.stringify(task));

      task
        .progress(percent => {
          console.log(
            "TCL: OfflineScreen -> resumeDownloads -> percent",
            percent
          );
          updatePodcast(task.id, "progress", String(Math.floor(percent * 100)));
        })
        .done(() => {
          const path =
            `${RNBackgroundDownloader.directories.documents}/` +
            task.id +
            ".mp3";
          console.log("TCL: OfflineScreen -> resumeDownloads -> path", path);
          updatePodcast(task.id, "path", path);
        })
        .error(error => {
          console.log("TCL: Download canceled due to error: ", error);
        });
    }
  };
};
