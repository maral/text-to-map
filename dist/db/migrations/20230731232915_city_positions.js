var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export function up(knex) {
    return __awaiter(this, void 0, void 0, function* () {
        yield knex.schema.alterTable("city", (t) => {
            t.double("wgs84_latitude").nullable();
            t.double("wgs84_longitude").nullable();
        });
    });
}
export function down(knex) {
    return __awaiter(this, void 0, void 0, function* () {
        yield knex.schema.alterTable("city", (t) => {
            t.dropColumn("wgs84_latitude");
            t.dropColumn("wgs84_longitude");
        });
    });
}
