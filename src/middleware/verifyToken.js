import jwt from "jsonwebtoken";

import { User } from "../models/index.js";

const verifyToken = async (req, res, next) => {
  try {
    let token;

    if (req.cookies.jwt) {
      token = req.cookies.jwt;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return res.status(401).json({ message: "Unauthorizedd" });

    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const user = await User.findByPk(decoded.id);

    if (!user) return res.status(401).json({ message: "Unauthorizede" });

    req.user = user;
    req.user.id = user.id.toString();

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized", error: error.message });
  }
};

export default verifyToken;
