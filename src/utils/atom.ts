import FeedParser from "feedparser";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";

export const getLatestUrlFromAtomFeed = async (
  atomFeedUrl: string
): Promise<string> => {
  const response = await fetch(atomFeedUrl);
  const feedparser = new FeedParser({});
  let link = null;

  if (response.status !== 200) {
    throw new Error(
      `The Atom feed from atom.cuzk.cz not working. HTTP status ${response.status}`
    );
  }

  feedparser.on("error", (error) => {
    throw new Error(`The Atom feed from atom.cuzk.cz could not be loaded.`);
  });

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

  await pipeline(response.body, feedparser);

  if (link != null) {
    return link;
  } else {
    throw new Error("Could not find any dataset feed link.");
  }
};

export const getAllUrlsFromAtomFeed = async (
  atomFeedUrl: string
): Promise<string[]> => {
  const response = await fetch(atomFeedUrl);
  const feedparser = new FeedParser({});
  const links: string[] = [];

  if (response.status !== 200) {
    throw new Error(
      `The Atom feed from atom.cuzk.cz not working. HTTP status ${response.status}`
    );
  }

  feedparser.on("error", (error) => {
    throw new Error(`The Atom feed from atom.cuzk.cz could not be loaded.`);
  });

  feedparser.on("readable", function () {
    let item: FeedParser.Item;

    while ((item = this.read())) {
      links.push(item.link);
    }
  });

  await pipeline(response.body, feedparser);

  if (links.length > 0) {
    return links;
  } else {
    throw new Error("Could not find any dataset feed link.");
  }
};
