"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.get("/", (req, res) => {
    res.render("home", { layout: "layouts/main" });
});
router.get("/login", (req, res) => {
    res.render("login", { layout: "layouts/main" });
});
router.get("/register", (req, res) => {
    res.render("register", { layout: "layouts/main" });
});
router.get("/stats", (req, res) => {
    res.render("stats", { layout: "layouts/main" });
});
router.get("/privacy", (req, res) => {
    res.render("privacy", { layout: "layouts/main" });
});
router.get("*", (req, res) => {
    res.render("404", { layout: "layouts/main" });
});
exports.default = router;
//# sourceMappingURL=IndexRoutes.js.map