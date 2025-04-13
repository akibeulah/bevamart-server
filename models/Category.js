const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema(
    {
        name: { type: String, required: true, unique: true },
        slug: { type: String, unique: true },
        parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
        description: String,
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

categorySchema.virtual('childCategories', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parentCategory'
});

categorySchema.pre('save', function(next) {
    if (this.isModified('name') || !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }
    next();
});

categorySchema.statics.getCategoryTree = async function() {
    const rootCategories = await this.find({ parentCategory: null })
        .sort({ displayOrder: 1, name: 1 })
        .populate({
            path: 'childCategories',
            options: { sort: { displayOrder: 1, name: 1 } }
        });

    return rootCategories;
};

categorySchema.methods.getCategoryPath = async function() {
    const path = [this];
    let currentCategory = this;

    while (currentCategory.parentCategory) {
        const parent = await this.constructor.findById(currentCategory.parentCategory);
        if (!parent) break;

        path.unshift(parent);
        currentCategory = parent;
    }

    return path;
};

categorySchema.pre(/^findOne/, function(next) {
    this.populate({
        path: 'childCategories',
        options: { sort: { displayOrder: 1, name: 1 } }
    });
    next();
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;