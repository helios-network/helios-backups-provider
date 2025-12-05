FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY . .

RUN npm run build

RUN npm prune --production

CMD ["node", "dist/index.js", "serve"]

