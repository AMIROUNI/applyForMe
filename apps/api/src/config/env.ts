import { registerAs } from '@nestjs/config';
import { validateEnv, EnvConfig } from './configuration';

export default registerAs('app', (): EnvConfig => {
  return validateEnv(process.env);
});