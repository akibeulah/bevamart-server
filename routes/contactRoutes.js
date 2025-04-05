// routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const {
    createContact,
    updateContact,
    deleteContact,
    getContactById,
    getAllContacts, contactOverview
} = require('../services/contactServices');
const { verifyUserAuthenticated, verifyUserRoleAdmin } = require('../middleware/authenticationMiddleware');

router.post(
    '/contacts',
    createContact
);

router.get(
    '/contacts/overview',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    contactOverview
)

router.put(
    '/contacts/:id',
    verifyUserAuthenticated,
    // verifyUserRoleAdmin,
    updateContact
);

router.delete(
    '/contacts/:id',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    deleteContact
);

router.get(
    '/contacts/:id',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getContactById
);

router.get(
    '/contacts',
    verifyUserAuthenticated,
    verifyUserRoleAdmin,
    getAllContacts
);


module.exports = router;
