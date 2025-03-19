## Demo Testing of the project: 

For Contract address use: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 


For Contract ABI use: [
  {
    "constant": false,
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "recipient", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

Select Function as Transfer: 

* Recipient: 0x0000000000000000000000000000000000000000 (or any valid address)
* Amount: 1000000 (USDC has 6 decimals, so this is 1 USDC)
* Add a description like "Test USDC Transfer"
* Click on the generate link and you are good to go! (if you are on a local host otherwise aws OTP verification will fail for some unknown reason)

## Architecture Diagram

![Image](architecture.png)

## User Flow

As a developer I want to generate a TXN link for users

As a user, I want to execute the TXN that was sent by the developer
![Image](flow.png)

### AWS link:

http://metakeep-assignment.s3-website.eu-north-1.amazonaws.com

Please note: Otp verification is likely to fail on this server. To use this project to full potential please clone this repo on your local machine

## Project Setup

Clone the project by running the command

        git clone https://github.com/meetjn/mtkp-assignment.git

Run the command

        npm install

        npm start

Please make sure to create a .env file as shown in .env.example file and getting its credentials correctly

The project should start at localhost:3000

## Challenges faced

#### 1. Minor - Importing metakeep's sdk + how to correctly install turns out how I had to search in the npm website

#### 2. Minor - Hosting this project on AWS, had to figure out what files to put under the root because I uploaded the whole build folder

#### 3. Biggest one - When testing this project on localhost it worked by this I mean the otp was getting verified while hitting on the connect wallet button, however when doing the same testing on aws hosted server otp verification failed and so does the sharable transaction link generation

#### 4. At some point I was faced to use AI to write code mainly Claude, I faced several pain points such as errors in frontend which I had to resolve either by google or by using perplexity but overall it was fun learning and using AI technology in my IDE. it made me more productive

## FAQs

##### Q. What are the features does this project accommodates?

-> Two feature, it lets developer enters the smart contract details (contract address, abi, rpc url), generates sharable link and lets users view transaction details, and signs the transaction using the MetaKeep's SDK with their embedded wallet.

##### Q. Have you used any AI while completing this project?

-> Yes, perplexity for doing the most amount of research i.e. laying out plan. And used claude 3.5 for fixing errors + co-pilot

##### Q. Have you implemented any measure that prevents abuse, How?

-> Yes, implemented rate limiting to generate 10 transactions per minute and considering CAPTCHA verification to prevent bot spamming to the app.

##### Q. Are there any CI/CD pipeline used into the project?

-> Yes, CI/CD is present.

##### Q. Are there any UI testing done?

-> no, not yet
