import { School } from "./types";
export declare const insertSchools: (schools: School[], doNotClearTable?: boolean) => number;
export declare const findSchool: (name: string, schools: School[]) => {
    school: School | null;
    errors: string[];
};
