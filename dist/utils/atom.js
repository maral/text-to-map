var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import FeedParser from "feedparser";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";
export const getLatestUrlFromAtomFeed = (atomFeedUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield fetch(atomFeedUrl);
    const feedparser = new FeedParser({});
    let link = null;
    if (response.status !== 200) {
        throw new Error(`The Atom feed from atom.cuzk.cz not working. HTTP status ${response.status}`);
    }
    feedparser.on("error", (error) => {
        throw new Error(`The Atom feed from atom.cuzk.cz could not be loaded.`);
    });
    feedparser.on("readable", function () {
        let item;
        let maxDate = new Date();
        maxDate.setFullYear(1990);
        while ((item = this.read())) {
            if (item.date > maxDate) {
                maxDate = item.date;
                link = item.link;
            }
        }
    });
    yield pipeline(response.body, feedparser);
    if (link != null) {
        return link;
    }
    else {
        throw new Error("Could not find any dataset feed link.");
    }
});
export const getAllUrlsFromAtomFeed = (atomFeedUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield fetch(atomFeedUrl);
    const feedparser = new FeedParser({});
    const links = [];
    if (response.status !== 200) {
        throw new Error(`The Atom feed from atom.cuzk.cz not working. HTTP status ${response.status}`);
    }
    feedparser.on("error", (error) => {
        throw new Error(`The Atom feed from atom.cuzk.cz could not be loaded.`);
    });
    feedparser.on("readable", function () {
        let item;
        while ((item = this.read())) {
            links.push(item.link);
        }
    });
    yield pipeline(response.body, feedparser);
    if (links.length > 0) {
        return links;
    }
    else {
        throw new Error("Could not find any dataset feed link.");
    }
});
