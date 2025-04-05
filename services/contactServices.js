// services/contactServices.js
const {default: mongoose} = require('mongoose');
const Contact = require('../models/Contact');
const {defaultResponse} = require('../utils/requestHelper');

const createContact = async (req, res, next) => {
    try {
        const {name, email, phone_number, subject, message} = req.body;
        const contact = new Contact({name, email, phone_number, subject, message});

        await contact.save();
        return defaultResponse(res, [201, 'Contact created successfully', contact]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const updateContact = async (req, res, next) => {
    try {
        const contact = await Contact.findOne(new mongoose.Types.ObjectId(req.params.id))
        if (!contact)
            return defaultResponse(res, [500, 'This contact does not exist', ""]);

        const updatedContact = await Contact.findByIdAndUpdate(
            req.params.id,
            {attended: !contact.attended},
            {new: true}
        );
        return defaultResponse(res, [200, 'Contact updated successfully', updatedContact]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const deleteContact = async (req, res, next) => {
    try {
        const deletedContact = await Contact.findByIdAndDelete(req.params.id);
        return defaultResponse(res, [200, 'Contact deleted successfully', deletedContact]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getContactById = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.id);
        return defaultResponse(res, [200, 'Contact retrieved successfully', contact]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const getAllContacts = async (req, res, next) => {
    try {
        const {perPage, page, statusFilter} = req.query;
        const filter = {};

        if ((Array.isArray(statusFilter) ? statusFilter[0] : statusFilter) !== "all") {
            filter.attended = (Array.isArray(statusFilter) ? statusFilter[0] : statusFilter) === "attended";
        }

        // Calculate skip value for pagination
        const skip = (page - 1) * perPage;

        const contacts = await Contact.find(filter)
            .limit(parseInt(perPage))
            .skip(skip);

        return defaultResponse(res, [200, 'Contacts retrieved successfully', {
            page,
            perPage,
            statusFilter: (Array.isArray(statusFilter) ? statusFilter[0] : statusFilter),
            data: contacts
        }]);
    } catch (error) {
        console.error(error);
        return defaultResponse(res, [500, 'Oops, something went wrong', error]);
    }
};

const contactOverview = async (req, res, next) => {
    try {
        const totalContacts = await Contact.countDocuments();
        const unattendedContacts = await Contact.countDocuments({attended: false});
        const attendedContacts = await Contact.countDocuments({attended: true});

        return defaultResponse(res, [200, 'Contacts retrieved successfully', {
            numberOfContacts: totalContacts,
            unattendedContacts: unattendedContacts,
            attendedContacts: attendedContacts
        }]);
    } catch (error) {
        console.error(error);
        throw new Error('Error fetching contact overview');
    }
};


module.exports = {createContact, updateContact, deleteContact, getContactById, getAllContacts, contactOverview};
