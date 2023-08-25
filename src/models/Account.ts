import mongoose from "mongoose";
const Schema = mongoose.Schema;

export interface Account {
  username: string,
  passwordHash: string,
  code: string,
  reputation: number,
};

export interface AccountDocument extends Account {
    _id: mongoose.ObjectId,
    createdAt: Date,
    updatedAt: Date,
}

const AccountSchema = new Schema<AccountDocument>({
  username: {
    type: String,
    required: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true
  },
  reputation: {
    type: Number,
    required: true,
    default: 0,
    set: (val: number) => Math.trunc(val)
  }
}, { timestamps: true });

AccountSchema.index({ guildId: 1, userId: 1});

export const AccountTable = mongoose.model<AccountDocument>("Account", AccountSchema);