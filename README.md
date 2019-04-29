**PMReferrals.ca**

A handy free service to find a Public Mobile referral number to get the $10 credit when signing up for a new account. You can also add your own number to get additional referral rewards. Built in NodeJS, hosted by Openode.io. Made in Canada.

**Features**

* Instantly get a referral to use when signing up for Public Mobile account.
* Register your Public Mobile number to get randomly selected when other people request a referral.
* Only one referral per email address. Disposable/spam addresses are blocked.
* Multiple methods to make sure the referral numbers are valid
    * Validating the number's legitimacy and carrier
    * Post-referral survey ("Did this referral work?")
    * Monthly reminder to confirm registration with Public Mobile (or number is removed from the draw pool)
* Recieve notifications for:
    * New referrals with your number
    * Changes to your referral account

**Contributing**

PMReferrals is built using NodeJS (and the Express HTTPS server). It uses MongoDB as a database, and Handlebars as a templating engine for both the pages and emails.

To get it set up for local development on your own machine, you will need to:

1. Fork and clone.
2. Install NodeJS and MongoDB.
3. Run `npm install` in the project directory you cloned to.
4. Set up a MongoDB local database (I think you can use SRV URLs to connect locally, but if not please let me know!)
5. In the root folder of the project, create a ".env" file with the environment variables shown in the next section (change the values to suit).
6. Once that's done, run `npm start` in the project directory to launch a local instance of PMReferrals.

```
MONGODB_USERNAME=username
MONGODB_PASSWORD=password1
MONGODB_URL=exampledb.com
MONGODB_DATABASE=database_name

EMAIL_ADDRESS=example@example.com
EMAIL_PASSWORD=password2
SMTP_SERVER=mail.example.com
SMTP_PORT=465

ADMIN_EMAIL=admin@example.com
BASE_URL=https://example.com
```
The MongoDB fields are used to build the SRV connect URL. Take a look at app/database.js to see how it works.

At the time of writing you will need access to an email address that allows programmatic connections, since most of the app's functions are email based.

The admin email can just be your own email. It's used to define the admin of the site, for use in the lottery system. You *must* register your own email on the local PMReferrals instance.

Lastly, the base URL requires the http:// or https:// prefix. This field is used to build links in the notification email templates.

**Bug Reports**

If you are using the site and find a problem, please feel free to create a new issue on this repository. It will be super helpful as we try to build a useful tool for everyone.
