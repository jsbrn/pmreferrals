import express from "express";
import { success, error, exception } from "../services/HTTPService";

const router = express.Router();

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

export default router;