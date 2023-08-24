FROM node:18-slim

WORKDIR /usr/src/app

COPY . ./

# Make a clean npm install
RUN npm ci

RUN ["npm", "run", "build"]

EXPOSE 8080
EXPOSE 4433

CMD ["node", "dist/index.js"]
