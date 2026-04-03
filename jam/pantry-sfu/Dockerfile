FROM node:20-alpine
RUN apk add --no-cache linux-headers make python3 py3-pip g++
ENV JAM_CONFIG_DIR=/jam-config
RUN mkdir /pantry-sfu
WORKDIR /pantry-sfu
COPY yarn.lock package.json /pantry-sfu/
RUN yarn
COPY . /pantry-sfu
EXPOSE 30002
CMD node run.js
