FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl gosu && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN HUSKY=0 npm ci
COPY . .
RUN npm run db:generate && npm run build

FROM base
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:./data/chordrrific.db
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/database-url.ts ./database-url.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/lib/server/generated ./src/lib/server/generated
COPY --from=build /app/src/lib/core/validation.ts ./src/lib/core/validation.ts
COPY scripts/container-entrypoint.sh /usr/local/bin/chordrrific-entrypoint
RUN chmod +x /usr/local/bin/chordrrific-entrypoint && mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/chordrrific-entrypoint"]
CMD ["node", "build"]
