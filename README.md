**PMReferrals.ca**

A handy free service to find a Public Mobile referral code to get the $10 credit when signing up for a new account. You can also add your own code to collect referral bonuses. Built with NodeJS, hosted by Openode.io.

**Features**

* Instantly get a referral to use when signing up for Public Mobile account.
* Register your Public Mobile referral code to get randomly selected when other people request a referral.
* Codes are verified on Public Mobile's website before being accepted into the database.
* If a user closes their PM account, PMReferrals will delete the code the next time someone tries to use it.

**Contributing**

PMReferrals is built using NodeJS (and the Express HTTPS server). It uses MongoDB as a database, and Handlebars as a templating engine for both the pages and emails.

To get it set up for local development on your own machine, you will need to:

1. Fork and clone.
2. Install NodeJS and MongoDB.
3. Run `npm install` in the project directory you cloned to.
4. Set up a MongoDB local database and configure the environment variables.
5. In the root folder of the project, create a ".env" file with the environment variables shown in the next section (change the values to suit).
6. Once that's done, run `npm start` in the project directory to launch a local instance of PMReferrals.

**Environment Variables**

The project reads environment variables from a .env file in the root directory. Change the values to suit your setup.

```
MONGODB_USERNAME=username
MONGODB_PASSWORD=password1
MONGODB_URL=exampledb.com
MONGODB_PORT=27017
MONGODB_DATABASE=database_name
MONGODB_SRV_RECORD=false

MOCK_CODE_VALIDATION=false

EMAIL_ADDRESS=example@example.com
EMAIL_PASSWORD=password2
SMTP_SERVER=mail.example.com
SMTP_PORT=465

BASE_URL=https://example.com
```

When `MOCK_CODE_VALIDATION` is true, the codes will always be accepted. Email is not currently used by the application, so don't worry about configuring it. It used to be, in an older version.

**Bug Reports**

If you are using the site and find a problem, please feel free to create a new issue on this repository. It will be super helpful as we try to build a useful tool for everyone.
