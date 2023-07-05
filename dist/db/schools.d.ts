import { SmdError } from "../street-markdown/types";
import { School } from "./types";
export declare const insertSchools: (schools: School[]) => Promise<number>;
export declare const findSchool: (name: string, schools: School[]) => {
    school: School | null;
    errors: SmdError[];
};
