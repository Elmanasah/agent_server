import { UserService } from "./user.service.js";
import { catchAsync } from "../../utils/catchAsync.js";

export const getAllUsers = catchAsync(async (req, res) => {
  const { users, usersCount } = await UserService.getAllUsers(req.query);
  res.status(200).json({ count: usersCount, data: users });
});

export const getPublicProfile = catchAsync(async (req, res) => {
  const user = await UserService.getPublicProfile(req.params.id);
  res.status(200).json({ data: user });
});

export const getUser = catchAsync(async (req, res) => {
  const user = await UserService.getUser(req.params.id);
  res.status(200).json({ data: user });
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await UserService.updateUser(req.params.id, req.body);
  res.status(200).json({ message: "User updated", data: user });
});

export const deleteUser = catchAsync(async (req, res) => {
  await UserService.deleteUser(req.params.id);
  res.status(200).json({ message: "User deleted successfully" });
});

export const findUserByEmail = catchAsync(async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({
      status: "error",
      message: "Email query parameter is required",
    });
  }
  const user = await UserService.findUserByEmail(email);
  res.status(200).json({ data: user });
});

export const getPlatformStats = catchAsync(async (req, res) => {
  const stats = await UserService.getPlatformStats();
  res.status(200).json({ status: "success", data: stats });
});
