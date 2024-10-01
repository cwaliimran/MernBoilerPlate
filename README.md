# MERN Boilerplate Project
The **MERN Boilerplate** is a starter template for building full-stack web applications using MongoDB, Express.js, React, and Node.js. This project provides a scalable and organized codebase that you can quickly adapt for various applications such as social apps, e-commerce platforms, or any custom projects.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [Postman Collection](#postman-collection)
- [License](#license)
- [Contact](#contact)

## Features

- JWT-based Authentication (login, register, password reset)
- Social Logins (Google, Facebook, Apple)
- RESTful API with CRUD functionality
- Secure API endpoints using role-based authentication
- Rate Limiting for certain endpoints
- Modular and scalable code structure
- Environment-based configuration

## Installation

- npm i

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) >= v14.x
- [MongoDB](https://www.mongodb.com/) (Running as a replica set for transactions)
- [NPM](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)

### Steps

1. Clone the repository:

    ```bash
    git clone https://github.com/cwaliimran/MernBoilerPlate.git
    ```

2. Update locales in "assets/locales" 

3. firebaseAdmin.js -> update database url. Replace {{project-5c684}} with project ID from Firebase -> Project settings/General/Project ID

4. create a serviceAccountKey.json file in secretAssets folder at ROOT DIRECTORY OF PROJECT and DOWNLOAD FILE FROM Firebase -> Project settings/Service accounts/Generate new private key

5. Add the contents of downloaded key in serviceAccountKey.json

## Technologies Used

- MongoDB
- Express.js
- React
- Node.js

## Project Structure

- `src/` - Contains the source code
- `config/` - Configuration files
- `models/` - Database models
- `routes/` - API routes
- `controllers/` - Request handlers
- `middlewares/` - Custom middleware functions

## Postman Collection

- `postman_collection/` - Postman collection

## License

This project is licensed under the MIT License.

## Contact

For any inquiries, please contact [cwaliimran@gmail.com].
