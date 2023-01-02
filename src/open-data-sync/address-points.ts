import FeedParser from "feedparser";
import fetch from "node-fetch";
import request from "superagent";
import { createWriteStream, readdir, createReadStream, rmSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import iconv from "iconv-lite";

import { tmpdir } from "os";
import {
  commitAddressPoints,
  importParsedLine,
  setDbConfig,
} from "./search-db";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsNotEmpty,
  prepareOptions,
} from "../utils/helpers";

const getLatestUrlFromAtomFeed = (
  atomFeedUrl: string,
  onSuccess?: (url: string) => void
) => {
  const req = fetch(atomFeedUrl);
  const feedparser = new FeedParser({});

  req.then(
    (res) => {
      if (res.status !== 200) {
        throw new Error(
          `The Atom feed from atom.cuzk.cz not working. HTTP status ${res.status}`
        );
      } else {
        res.body.pipe(feedparser);
      }
    },
    (err) => {
      reportError(err);
      return;
    }
  );

  feedparser.on("error", (error) => {
    throw new Error(`The Atom feed from atom.cuzk.cz could not be loaded.`);
  });

  let link = null;
  feedparser.on("readable", function () {
    let item: FeedParser.Item;

    let maxDate = new Date();
    maxDate.setFullYear(1990);
    while ((item = this.read())) {
      if (item.date > maxDate) {
        maxDate = item.date;
        link = item.link;
      }
    }
  });

  feedparser.on("end", () => {
    if (link != null) {
      onSuccess(link);
    } else {
      reportError("Could not find any dataset feed link.");
    }
  });
};

const downloadAndUnzip = (
  url: string,
  options: OpenDataSyncOptionsNotEmpty,
  onSuccess?: () => void
) => {
  const zipFilePath = join(options.tmpDir, options.addressPointsZipFileName);

  console.log("downloading a large ZIP file with RUIAN data...");
  request
    .get(url)
    .on("error", function (error) {
      reportError(error);
    })
    .pipe(createWriteStream(zipFilePath))
    .on("finish", function () {
      console.log("finished downloading");
      const zip = new AdmZip(zipFilePath);
      console.log("starting unzip");
      zip.extractAllTo(options.tmpDir, true);
      console.log("finished unzip");
      rmSync(zipFilePath);
      console.log("removed the ZIP file");

      if (typeof onSuccess !== "undefined") {
        onSuccess();
      }
    });
};

const reportError = (error: any) => {
  if (error.hasOwnProperty("stack")) {
    console.log(error, error.stack);
  } else {
    console.log(error);
  }
};

const importDataToDb = (
  options: OpenDataSyncOptionsNotEmpty,
  onSuccess?: () => void
) => {
  const extractionFolder = getExtractionFolder(options);

  readdir(extractionFolder, (error, files) => {
    if (error) {
      reportError(error);
      return;
    }

    let total = 0;
    let next = 0;

    console.log("Initiating import of RUIAN data to search DB.");
    setDbConfig({
      filePath: options.dbFilePath,
      initFilePath: options.dbInitFilePath,
    });
    const promises = files.map(
      (file) =>
        new Promise<void>((resolve, reject) => {
          createReadStream(join(extractionFolder, file))
            .pipe(iconv.decodeStream("win1250"))
            .pipe(parse({ delimiter: ";", fromLine: 2 }))
            .on("data", (data) => {
              total += importParsedLine(data);
              if (total - next >= 100000) {
                next += 100000;
                console.log(`Total imported rows: ${next}`);
              }
            })
            .on("error", reportError)
            .on("end", function () {
              total += commitAddressPoints();
              resolve();
            });
        })
    );

    Promise.all(promises).then(() => {
      console.log(`Import completed. Total imported rows: ${total}`);
      if (typeof onSuccess !== "undefined") {
        onSuccess();
      }
    });
  });
};

const getExtractionFolder = (options: OpenDataSyncOptionsNotEmpty) =>
  join(options.tmpDir, options.addressPointsCsvFolderName);

export const downloadAndImportAllLatestAddressPoints = (
  options: OpenDataSyncOptions,
  onSuccess?: () => void
) => {
  const completeOptions = prepareOptions(options);
  getLatestUrlFromAtomFeed(
    completeOptions.addressPointsAtomUrl,
    (datasetFeedLink) => {
      getLatestUrlFromAtomFeed(datasetFeedLink, (url) => {
        downloadAndUnzip(url, completeOptions, () => {
          importDataToDb(completeOptions, onSuccess);
        });
      });
    }
  );
};

downloadAndImportAllLatestAddressPoints({});
