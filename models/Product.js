const mongoose = require('mongoose');
const fs = require('fs');
const TssMailer = require('../services/mailerService');
const {lowAlertNotificationSubject} = require('../mailer/emailString');
const {Schema} = mongoose;

const productSchema = new Schema(
    {
        name: {type: String, required: true},
        slug: {type: String, unique: true},
        brand: {type: String, required: true},
        productImages: {type: [String]},
        description: {type: String, required: true},
        price: {type: Number, required: true},
        amount: {type: Number, default: 1},
        unit: {type: String, default: "unit(s)"},
        stock: {type: Number, required: true},
        tags: [String],
        category: {type: mongoose.Schema.Types.ObjectId, ref: 'Category'},
        type: {type: mongoose.Schema.Types.ObjectId, ref: 'Type', required: false},
        status: {type: String, enum: ['active', 'archive'], required: true},
        lowAlert: {type: Number, default: 0},
        views: {type: Number, default: 0},
        inventory: [{type: mongoose.Schema.Types.ObjectId, ref: 'Inventory'}],
        hasVariants: {type: Boolean, default: false},
        variants: [{type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant'}],
        variantOptions: [{type: mongoose.Schema.Types.ObjectId, ref: 'ProductAttributeOption'}]
    },
    {
        timestamps: true,
    }
);

const generateSlug = (brand, name) => {
    let slug = `${brand ? `${brand}-` : ''}${name}`;
    return slug.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/&/g, 'and')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

const sendLowStockAlert = async function (product) {
    if (product.stock <= product.lowAlert) {
        const htmlFile = fs.readFileSync('./mailer/emailTemplates/productLowAlertEmailTemplate.html', 'utf-8');

        const processedHtml = htmlFile
            .replace(/{{product_image}}/g, product.productImages[0])
            .replace(/{{product_name}}/g, product.name)
            .replace(/{{in_stock}}/g, product.stock)
            .replace(/{{low_alert_value}}/g, product.lowAlert);

        await TssMailer(process.env.SMTP_USERNAME, lowAlertNotificationSubject, '', processedHtml);
    }
};

productSchema.pre('save', async function (next) {
    this.slug = generateSlug(this.brand, this.name);
    await sendLowStockAlert(this);
    next();
});

// Define an array of update hooks
const updateHooks = ['updateOne', 'findByIdAndUpdate', 'findOneAndUpdate', 'update'];

updateHooks.forEach((hook) => {
    productSchema.post(hook, async function (res) {
        try {
            const product = await this.model.findOne(this.getQuery());

            if (product) {
                await sendLowStockAlert(product);
                product.slug = generateSlug(product.brand, product.name)
                await product.save()
            }
        } catch (err) {
            console.error('Error fetching updated document:', err);
        }
    });
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
