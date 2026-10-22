import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(72),
  displayName: z.string().trim().min(2).max(60),
  adultConfirmed: z.literal(true)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72)
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Confira os dados, use uma senha de 12 a 72 caracteres e confirme que tem 18 anos ou mais.'
    });
  }

  const email = parsed.data.email.toLowerCase();
  const { password, displayName } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return res.status(409).json({
        error: 'EMAIL_IN_USE',
        message: 'Não foi possível criar a conta com esse e-mail.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, displayName },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true
      }
    });

    return res.status(201).json({
      message: 'Conta criada. A verificação de e-mail ainda precisa ser implementada.',
      user
    });
  } catch {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Não foi possível criar a conta agora.'
    });
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Informe um e-mail e uma senha válidos.'
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    return res.status(500).json({
      error: 'SERVER_CONFIGURATION',
      message: 'O login ainda não está configurado.'
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() }
    });

    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    ) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha incorretos.'
      });
    }

    if (user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      return res.status(403).json({
        error: 'ACCOUNT_UNAVAILABLE',
        message: 'Esta conta não está disponível.'
      });
    }

    const token = jwt.sign(
      { role: user.role },
      secret,
      { subject: user.id, expiresIn: '1h' }
    );

    return res.json({
      token,
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status
      }
    });
  } catch {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Não foi possível fazer login agora.'
    });
  }
});

export default router;

