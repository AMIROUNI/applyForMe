import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({});

export const exchangeCodeSchema = z.object({
  code: z.string().min(1),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  refreshToken: z.string().optional(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    createdAt: z.date().or(z.string().datetime()),
  }),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.date().or(z.string().datetime()),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type ExchangeCodeDto = z.infer<typeof exchangeCodeSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type UserDto = z.infer<typeof userSchema>;