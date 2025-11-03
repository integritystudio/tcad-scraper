FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production --omit=optional || npm install --production --force

COPY index.js ./

EXPOSE 3000

CMD ["npm", "start"]
