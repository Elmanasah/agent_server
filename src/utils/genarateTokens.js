import jwt from "jsonwebtoken";

const generateToken = async (payload) => {
  const token = await jwt.sign({ ...payload }, process.env.SECRET_KEY, {
    expiresIn: process.env.EXPIRES_IN || "1d",
  });

  return token;
};

export default generateToken;
