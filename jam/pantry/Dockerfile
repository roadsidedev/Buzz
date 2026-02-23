FROM node:20-alpine
ENV JAM_CONFIG_DIR=/jam-config
RUN mkdir /pantry
WORKDIR /pantry
COPY package.json /pantry/
RUN npm install --production
COPY . /pantry
EXPOSE 3000
CMD node ./bin/www
