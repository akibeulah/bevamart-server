const mongoose = require('mongoose');
const fs = require('fs');
const TssMailer = require('../services/mailerService');
const {lowAlertNotificationSubject} = require('../mailer/emailString');
const { Schema } = mongoose;

const productVariantSchema = new Schema(
    {
        parentProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        sku: { type: String, required: true, unique: true },
        attributeOptions: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProductAttributeOption", required: true }],
        price: { type: Number, required: true },
        stock: { type: Number, required: true, default: 0 },
        images: [{ type: String }],
        active: { type: Boolean, default: true },
        lowAlert: { type: Number, default: 0 }
    },
    {
        timestamps: true
    }
);

// Helper function to create a descriptive title from attribute options
productVariantSchema.methods.getVariantTitle = async function() {
    try {
        await this.populate({
            path: 'attributeOptions',
            populate: {
                path: 'attribute'
            }
        });

        const sortedOptions = [...this.attributeOptions].sort((a, b) =>
            a.attribute.displayOrder - b.attribute.displayOrder
        );

        return sortedOptions.map(option => option.displayName).join(' - ');
    } catch (error) {
        console.error('Error generating variant title:', error);
        return 'Variant';
    }
};

// Check for low stock and send alerts
const sendLowStockAlert = async function (variant) {
    if (variant.stock <= variant.lowAlert) {
        try {
            await variant.populate({
                path: 'parentProduct',
                select: 'name productImages'
            });

            const htmlFile = fs.readFileSync('./mailer/emailTemplates/productLowAlertEmailTemplate.html', 'utf-8');

            const variantTitle = await variant.getVariantTitle();
            const productName = `${variant.parentProduct.name} - ${variantTitle}`;
            const productImage = variant.images.length > 0 ?
                variant.images[0] :
                (variant.parentProduct.productImages.length > 0 ? variant.parentProduct.productImages[0] : '');

            const processedHtml = htmlFile
                .replace(/{{product_image}}/g, productImage)
                .replace(/{{product_name}}/g, productName)
                .replace(/{{in_stock}}/g, variant.stock)
                .replace(/{{low_alert_value}}/g, variant.lowAlert);

            await TssMailer(process.env.SMTP_USERNAME, lowAlertNotificationSubject, '', processedHtml);
        } catch (error) {
            console.error('Error sending low stock alert for variant:', error);
        }
    }
};

productVariantSchema.pre('save', async function (next) {
    try {
        if (this.isModified('stock')) {
            await sendLowStockAlert(this);
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Define hooks for update operations
const updateHooks = ['updateOne', 'findByIdAndUpdate', 'findOneAndUpdate', 'update'];

updateHooks.forEach((hook) => {
    productVariantSchema.post(hook, async function (res) {
        try {
            const variant = await this.model.findOne(this.getQuery());
            if (variant) {
                await sendLowStockAlert(variant);
            }
        } catch (err) {
            console.error('Error checking variant stock after update:', err);
        }
    });
});

const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);

module.exports = ProductVariant;