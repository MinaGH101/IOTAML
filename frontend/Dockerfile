FROM node:22-alpine
WORKDIR /app
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
COPY package.json package-lock.json ./
RUN npm install -g npm@10.8.2 && npm ci --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
