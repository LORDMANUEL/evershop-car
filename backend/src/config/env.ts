import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

type EnvConfig = {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  storagePath: string;
  sar: {
    companyName: string;
    rtn: string;
    cai: string;
    rangeStart: string;
    rangeEnd: string;
    expiration: string;
  };
};

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'PORT',
  'SAR_COMPANY_NAME',
  'SAR_RTN',
  'SAR_CAI',
  'SAR_RANGE_START',
  'SAR_RANGE_END',
  'SAR_EXPIRATION'
] as const;

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} is missing`);
  }
});

const env: EnvConfig = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  storagePath: process.env.STORAGE_PATH ?? path.resolve(process.cwd(), 'storage'),
  sar: {
    companyName: process.env.SAR_COMPANY_NAME!,
    rtn: process.env.SAR_RTN!,
    cai: process.env.SAR_CAI!,
    rangeStart: process.env.SAR_RANGE_START!,
    rangeEnd: process.env.SAR_RANGE_END!,
    expiration: process.env.SAR_EXPIRATION!
  }
};

export default env;
