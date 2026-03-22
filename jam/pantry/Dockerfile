FROM node:20-alpine
ENV JAM_CONFIG_DIR=/jam-config
RUN mkdir /pantry
WORKDIR /pantry
COPY jam/pantry/package.json /pantry/
RUN npm install --production
COPY jam/pantry/ /pantry/
EXPOSE 3000
CMD node ./bin/www
