import { getKnexDb } from "./db";

export const getMetaValue = async (key: string): Promise<string | undefined> => {
  const knex = getKnexDb();
  const result = await knex.pluck("value").from("meta").where({ key });
  return result.length > 0 ? result[0] : undefined;
};

export const setMetaValue = async (key: string, value: any) => {
  const knex = getKnexDb();
  if (await getMetaValue(key) === undefined) {
    await knex.from("meta").insert({ key, value });
  } else {
    await knex.from("meta").update({ value }).where({ key });
  }
};

export const setCurrentDatetimeMetaValue = (key: string) => {
  setMetaValue(key, new Date().toISOString());
};

export const getDatetimeMetaValue = async (key: string): Promise<Date | undefined> => {
  const value = await getMetaValue(key);
  if (value === undefined) {
    return undefined;
  }
  return new Date(value);
};
