# KYC
A quick way to store the KYC Details and can share the key with others to access your KYC.
# hyperledger-composer-rest-server
Hyperledger Composer implementation wtih custom REST server

An example of how you could on about creating a custom REST API server that uses the npm Composer SDK packages to access and maintain your Hyperledger composer network.  



The project is split into 3 folders

- composer business network
- mongo-db
- server

### Prerequisites

**Python**

``` bash
sudo apt-get install python-minimal
```

**make and essentials**
```bash
sudo apt-get install build-essential
```

The project uses the next version of Hyperledger Composer so make sure the following npm packages are installed.

Essential CLI tools:

``` bash
npm install -g composer-cli@next
```

Useful utility for generating application assets:

``` bash
npm install -g generator-hyperledger-composer@next
```

Of course a running docker service is required as well.

As Hyperledger Composer is officialy not supported on Windows, this project is also best run on a Mac or Linux environment.


### Mongo db

The server project uses a mongo database so just run the following command to load up your mongo database from the mongodb folder.

`docker-compose up -d`

### Server

The server project is just a normal nodejs REST server written in Typescript using the Hapi npm package.  As a base template I used this excellent starter kit template and modified it to my liking. https://github.com/Talento90/typescript-node


Many people are wondering how you can link a normal email/password login kind of system to the Composer identity(business network card).  Therefore in this application I use normal JWT route authentication.   Users first request a token by providing their passport details which is a combination of email/password as any normal web application would use. Once a valid token is retrieved the user can use this token to authenticate the client for all future requests.  During these requests I then match the owner of the token to a matching Composer identity.


The idea is that whenever a user accesses a route, I create a new businessnetworkConnection.  This connection requires a business network card to work so I first retrieve it from the cardstore, which is a mongodb implementation in this project.
Once created and connected I can use this connection to access the registries and modify data as I like.  Once finished I disconnect the connection.


To start the server first update the packages.

``` bash
npm install
```

Then build and start the project with the following command

``` bash
npm run buildstart
```

The following routes are available:

**passport**

- POST /api/v1/passport/token:  get new token
- POST /api/v1/passport/user:  get user passport

**driver**

- GET /api/v1/drivers:  get all drivers, can be called with query parameter `resolve=true/false`
- GET /api/v1/drivers/query:  get all drivers but by using a defined query in the composer-business-network project
- GET /api/v1/drivers/${id}:  get a driver by ID, can be called with query parameter `resolve=true/false`
- POST /api/v1/drivers: create a new driver
- PUT /api/v1/drivers/${id}: update a new driver
- DELETE /api/v1/drivers/${id}: delete a new driver
- GET /api/v1/drivers/${id}/trucks: get all trucks for driver by query

All routes, except passport/token, require a JWT header `Authorization Bearer <token>`

Note:
It is not a final Application, This source code give you better understanding of Blockchain hyperledger composer.

