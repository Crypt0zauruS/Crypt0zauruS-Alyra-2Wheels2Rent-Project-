import crypto from "crypto";

function generateRandomToken(length = 30) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

export default async function handler(req, res) {
  const token = generateRandomToken();
  res.status(200).json({ token });
}
