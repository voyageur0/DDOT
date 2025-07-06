const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// Configuration de Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './urban_analysis.db',
  logging: false
});

// Modèle User
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(120),
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  stripeCustomerId: {
    type: DataTypes.STRING(100)
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING(100)
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  subscriptionEndDate: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.passwordHash) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
      }
    }
  }
});

// Méthodes d'instance pour User
User.prototype.checkPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

User.prototype.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

// Modèle Document
const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  originalFilename: {
    type: DataTypes.STRING(255)
  },
  commune: {
    type: DataTypes.STRING(100)
  },
  documentType: {
    type: DataTypes.STRING(50),
    defaultValue: 'reglement'
  },
  rawText: {
    type: DataTypes.TEXT
  },
  extractedData: {
    type: DataTypes.JSON
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  timestamps: true
});

// Modèle DocumentEmbedding
const DocumentEmbedding = sequelize.define('DocumentEmbedding', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  documentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Document,
      key: 'id'
    }
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  chunkText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  embedding: {
    type: DataTypes.BLOB  // Stockage des vecteurs en binaire
  },
  metadata: {
    type: DataTypes.JSON
  }
}, {
  timestamps: false
});

// Modèle Analysis
const Analysis = sequelize.define('Analysis', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  documentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Document,
      key: 'id'
    }
  },
  analysisType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  inputData: {
    type: DataTypes.JSON
  },
  result: {
    type: DataTypes.TEXT
  },
  tokensUsed: {
    type: DataTypes.INTEGER
  },
  costUsd: {
    type: DataTypes.FLOAT
  }
}, {
  timestamps: true
});

// Associations
User.hasMany(Document, { foreignKey: 'userId', as: 'documents' });
Document.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

User.hasMany(Analysis, { foreignKey: 'userId', as: 'analyses' });
Analysis.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Document.hasMany(DocumentEmbedding, { foreignKey: 'documentId', as: 'embeddings', onDelete: 'CASCADE' });
DocumentEmbedding.belongsTo(Document, { foreignKey: 'documentId', as: 'document' });

Document.hasMany(Analysis, { foreignKey: 'documentId', as: 'analyses' });
Analysis.belongsTo(Document, { foreignKey: 'documentId', as: 'document' });

// Export des modèles et de sequelize
module.exports = {
  sequelize,
  User,
  Document,
  DocumentEmbedding,
  Analysis
}; 