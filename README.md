# Deep learning on the web

This repository contains the source code for  `dl.web.js`, a platform for federated learning on the browser.

## Links
- Web app:   https://dlonweb.netlify.app/
- Documentation and project details :  https://shubhvjain.github.io/dlonweb/

## How to use the app ?

### Option 1 : Use the hosted app : 
- Simply go to  [https://dlonweb.netlify.app](https://dlonweb.netlify.app)  
- Upload your input, select a model and get the output - as simple as that!
- The inputs you upload stay on your browser 
  
### Option 2 : Host you own version 
- You can easily do that as well or just run it on your local machine 
- We provide a docker file for easy build and deployment of all app components

### Optional backend support

Due to resource constraints on the browser, we also provide a standalone backend service accessible via HTTP. It enables additional functionalities like converting Keras models for browser compatible inference

## How to Set Up the Optional Backend Server

- **Step 1:** Ensure that Docker is installed on your local machine. You can find installation instructions [here](https://docs.docker.com/engine/install/).

- **Step 2:** Clone the GitHub repository. This will download the latest code for the backend server from GitHub.
  - Command:  `git clone -b release https://github.com/shubhvjain/dlonweb.git`

- **Step 3:** Open a terminal and navigate to the project's root directory.

- **Step 4:** Run the Docker Compose command.
  - The `docker-compose.yml` file in the root directory can be used to start both the frontend and backend services.  
  - To run **only the backend**, use:  `docker compose up backend`  
  - To run **both** the frontend and backend, use:  `docker compose up`
- **Step 5:** The backend server runs by default on port 3000. Make sure to specify this URL in your frontend configuration.

## Folder structure

The project is divided into 3 main sub folders. 

### `core`
- The shared JS npm package with core abstract base classes for loading data , training the model and performing an inference task. 
- It is used as a local dependency in the frontend and backend packages and enables consistent behavior across the browser and server environment. 
- It is integrated using dependency injection allowing frontend and backend to plug in platform specific dependencies  to avoid duplicate logic. For instance, using `@tensorflow/tfjs` package in the frontend and `@tensorflow/tfjs-node` in the backend to use Tensorflow. 
- See the [README file](./core/README.md) for more details

### `frontend`
- Web-based user interface. 
- The main app. 
- Build using the [Svelte](https://svelte.dev/) framework. 
- Styling using [Bootstrap 5](https://getbootstrap.com/)
- See the [README file](./frontend/README.md) for more details


### `backend`
- Node.js backend with Python (Poetry) component.
- This serves and an additional,optional standalone service that can increase the power of the frontend. Needs to be run on a local port and is accessed via http from the frontend.
- See the [README file](./backend/README.md) for more details


### Additional items in the root folder

- `install.sh` :  Script to install all the whole project on a local computer. See the installation section for more details 
- `docs` : this folder contains documentation files along with some demo input and output data
- `backend.Dockerfile` : the docker file for backend
- `compose.yml` : The docker compose file for the project
- `frontend.Dockerfile` : the docker file for frontend
- `frontend.nginx.conf` : the nginx config file used in the docker container to serve frontend
- `netlify.toml` : the configuration file for deploying frontend on [netlify](https://www.netlify.com/)


## Installation 

Step to get the system running locally

- **Dependencies**
  - [Node.js](https://nodejs.org/en) (version 20 or above)
  - [Python](https://www.python.org/) (3.10 or above)
  - [Poetry](https://python-poetry.org/) 
- **Clone the repository** : `git clone https://github.com/shubhvjain/dlonweb1.git dlonweb` 
- `cd dlonweb`
- **Install all required dependencies**: There are 2 possible options here.
  - Install all dependencies at once using `install.sh` script. Run `./install.sh` from the root of the project
  - Individual components installations:
    - `core` : `cd core && npm install`
    - `frontend` : `cd frontend && npm install`
    - `backend` : `cd backend && npm install`. additionally, backend also depends on python, which m
- This can be done by installing each package individually. Or run `install.sh` script which will install all dependencies 



## Development notes  : Git workflow 

- All current development happens on the `main` branch 
- The current release version is on the `release` branch
- For new development, create a feature branch from `main` and create a PR to `main`
- To release a new version : create a PR from `main`  to `release`
