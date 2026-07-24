FROM node:22.14.0-alpine3.21 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM dependencies AS build
COPY . .
ARG VITE_API_URL=
ARG VITE_AMCHARTS_LICENSE_KEY=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_AMCHARTS_LICENSE_KEY=$VITE_AMCHARTS_LICENSE_KEY
RUN npm run build

FROM nginx:1.27.4-alpine3.21 AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
