import { AccountTable } from "../models/Account";
import { AccountRegistrationBody } from "../types/RequestTypes";
import bcrypt from "bcrypt";

async function createAccount(data: AccountRegistrationBody) {
    const hash = await bcrypt.hash(data.password, 10);
    return await AccountTable.create({
        username: data.username,
        passwordHash: hash,
        code: data.code
    });
}

async function usernameExists(username: string) {
    const existing = await AccountTable.findOne({ username });
    return existing != undefined;
}

async function codeExists(code: string) {
    const existing = await AccountTable.findOne({ code });
    return existing != undefined;
}

export default {
    createAccount,
    usernameExists,
    codeExists
};