const mongoose = require('mongoose');

const ownerInfoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  dob: {
    type: String,
    required: true,
  },
  name1: {
    type: String,
    required: true,
  },
  // Add any other personal info here
});

const OwnerInfo = mongoose.model('OwnerInfo', ownerInfoSchema);
module.exports = OwnerInfo;