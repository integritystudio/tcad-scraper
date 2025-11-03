FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production --omit=optional --no-optional

COPY index.js ./

EXPOSE 3000

CMD ["npm", "start"]
