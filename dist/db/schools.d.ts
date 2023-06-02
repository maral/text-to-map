import { School } from "./types";
export declare const insertSchools: (schools: School[]) => number;
export declare const findSchool: (name: string, schools: School[]) => {
    school: School | null;
    errors: string[];
};
