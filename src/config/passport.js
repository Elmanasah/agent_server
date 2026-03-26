import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User, UserUsage } from '../models/index.js';
import generateToken from '../utils/genarateTokens.js';
import { LogService } from '../modules/logs/log.service.js';
import dotenv from 'dotenv';

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. Check if user already exists with this googleId
        let user = await User.findOne({ where: { googleId: profile.id } });

        if (user) {
          const token = await generateToken({ id: user.id, role: user.role });
          return done(null, { user, token });
        }

        // 2. Check if user exists with the same email
        user = await User.findOne({ where: { email: profile.emails[0].value } });

        if (user) {
          // Link existing account with Google
          await user.update({
            googleId: profile.id,
            avatar: user.avatar || profile.photos[0]?.value || null,
          });
          const token = await generateToken({ id: user.id, role: user.role });
          return done(null, { user, token });
        }

        // 3. Create new user + assign default plan
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          avatar: profile.photos[0]?.value || null,
          role: 'user',
        });

        // Auto-assign the free plan for every new Google user
        await UserUsage.create({
          userId:      user.id,
          planName:    'free',
          periodStart: new Date(),
          lastResetAt: new Date(),
        });

        const token = await generateToken({ id: user.id, role: user.role });
        return done(null, { user, token });

      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
