**PMReferrals.ca**

A handy free service to find a Public Mobile referral code to get the $10 credit when signing up for a new account. You can also add your own code to collect referral bonuses. Built with NodeJS, hosted by Openode.io.

**Features**

* Instantly get a referral to use when signing up for Public Mobile account.
* Register your Public Mobile referral code to start collecting anonymous referrals.
* Codes are ranked by a scoring system. Collect points by maintaining activity on the site, and sharing it with others.
* Points are reset each week.
* Codes are automatically verified on registration and login. Removed from the rankings if found to be invalid.

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

MESSAGE=PMReferrals is down for maintenance.
SUBMESSAGE=Come back in an hour!
MAINTENANCE=false

BASE_URL=https://example.com
```

**Bug Reports**

If you are using the site and find a problem, please feel free to create a new issue on this repository. It will be super helpful as we try to build a useful tool for everyone.
