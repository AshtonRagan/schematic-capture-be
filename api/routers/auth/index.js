const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");

const { firebase, admin } = require('../../../utils/firebase');
const { dbToRes } = require("../../../utils");
const { Users, Organizations, Roles } = require("../../../data/models");

const {
  checkAccountExists,
  validateIdToken,
  validateInviteToken,
  validateRegistration
} = require("../../middleware/auth");

const { checkRoleExists } = require('../../middleware/roles');

router.post('/register', validateIdToken, checkAccountExists(false), validateInviteToken, validateRegistration, (req, res) => {
  const { userData }  = req;

  Users
    .add(userData)
    .then(user => res.status(201).json(user))
    .catch(async error => {
      const { auth } = admin;
      const { uid } = req.decodedIdToken;
      await auth().deleteUser(uid)
      res.status(500).json({ error: error.message });
    });
});

router.post("/login", validateIdToken, checkAccountExists(true), async (req, res) => {
  const { uid } = req.decodedIdToken;
  Users
    .findBy(uid) 
    .then(user => res.status(200).json(user))
    .catch(error => res.status(500).json({ error: error.message }));
});

router.post("/forgotPassword", (req, res) => {
  const { email } = req.body;
  const auth = firebase.auth();

  auth
    .sendPasswordResetEmail(email)
    .then(() => {
      return res.status(200).json({
        success: "Please check your inbox for the password reset e-mail."
      });
    })
    .catch(error => {
      console.log(error);
      return res.status(500).json({ error });
    });
});

router.post("/changeEmail", validateIdToken, (req, res) => {
  const { newEmail } = req.body;
  const user = firebase.auth().currentUser;

  user
    .updateEmail(newEmail)
    .then(() => {
      return res.status(200).json({
        success: `Your email address has been changed to ${newEmail}`
      });
    })
    .catch(error => {
      console.log(error);
      res.status(500).json({ error: "Unable to update email address." });
    });
});

router.post("/invite", validateIdToken, checkRoleExists, async (req, res) => {
  const { id, organization_id } = await Users.findBy({
    "users.id": req.uid
  }).first();

  const { roleId, name, email } = req.body;

  const contents = { organizationId: organization_id, roleId, inviter: id, time: new Date().getTime() };

  const sgApiKey = process.env.SG_API_KEY;
  const templateId = process.env.SG_TEMPLATE_ID;
  const registrationUrl = process.env.REGISTER_URL;
  const inviteToken = signInvite(contents);

  const config = {
    headers: {
      Authorization: `Bearer ${sgApiKey}`
    }
  };

  const data = {
    personalizations: [
      {
        to: [{ email, name }],
        dynamic_template_data: { registrationUrl, inviteToken }
      }
    ],
    from: {
      email: "invitation@schematiccapture.com",
      name: "Schematic Capture"
    },
    template_id: templateId
  };

  axios
    .post("https://api.sendgrid.com/v3/mail/send", data, config)
    .then(() =>
      res
        .status(202)
        .json({ message: `successfully sent invitation to ${email}` })
    )
    .catch(error =>
      res.status(500).json({ error: error.message, step: "sendgridInvite" })
    );
});

function signInvite(contents) {
  const secret = process.env.INVITE_SECRET;
  const options = { expiresIn: "1hr" };

  return jwt.sign(contents, secret, options);
}

module.exports = router;
