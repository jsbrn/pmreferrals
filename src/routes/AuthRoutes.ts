import express from "express";
import { success, error, exception } from "../services/HTTPService";
import { AccountRegistrationBody } from "../types/RequestTypes";
import { AccountTable } from "../models/Account";
import AccountService from "../services/AccountService";

const router = express.Router();

router.post("/create", async (req, res) => {
    const body = req.body as AccountRegistrationBody;
    try {
        const nameExists = await AccountService.usernameExists(body.username);
        const codeExists = await AccountService.codeExists(body.code);
        const newAccount = await AccountService.createAccount(body);
    } catch (error) {
        return res.sendStatus(500);
    }
});

export default router;