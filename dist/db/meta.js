var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getKnexDb } from "./db";
export const getMetaValue = (key) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb();
    const result = yield knex.pluck("value").from("meta").where({ key });
    return result.length > 0 ? result[0] : undefined;
});
export const setMetaValue = (key, value) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb();
    if ((yield getMetaValue(key)) === undefined) {
        yield knex.from("meta").insert({ key, value });
    }
    else {
        yield knex.from("meta").update({ value }).where({ key });
    }
});
export const setCurrentDatetimeMetaValue = (key) => {
    setMetaValue(key, new Date().toISOString());
};
export const getDatetimeMetaValue = (key) => __awaiter(void 0, void 0, void 0, function* () {
    const value = yield getMetaValue(key);
    if (value === undefined) {
        return undefined;
    }
    return new Date(value);
});
