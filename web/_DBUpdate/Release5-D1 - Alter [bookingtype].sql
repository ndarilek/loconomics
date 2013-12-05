/*
   jueves, 05 de diciembre de 201314:10:47
   User: 
   Server: localhost\SQLEXPRESS
   Database: loconomics
   Application: 
*/

/* To prevent any potential data loss issues, you should review this script in detail before running it outside the context of the database designer.*/
BEGIN TRANSACTION
SET QUOTED_IDENTIFIER ON
SET ARITHABORT ON
SET NUMERIC_ROUNDABORT OFF
SET CONCAT_NULL_YIELDS_NULL ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
COMMIT
BEGIN TRANSACTION
GO
ALTER TABLE dbo.bookingtype
	DROP CONSTRAINT DF__bookingty__Servi__2121D3D7
GO
ALTER TABLE dbo.bookingtype
	DROP CONSTRAINT DF__bookingty__Servi__2215F810
GO
ALTER TABLE dbo.bookingtype
	DROP CONSTRAINT DF__bookingty__Servi__230A1C49
GO
ALTER TABLE dbo.bookingtype
	DROP CONSTRAINT DF__bookingty__Payme__23FE4082
GO
CREATE TABLE dbo.Tmp_bookingtype
	(
	BookingTypeID int NOT NULL,
	BookingTypeName varchar(50) NOT NULL,
	BookingTypeDescription varchar(500) NULL,
	CreatedDate datetime NOT NULL,
	UpdatedDate datetime NOT NULL,
	ModifiedBy varchar(25) NOT NULL,
	Active bit NOT NULL,
	ServiceFeeFixed decimal(5, 2) NOT NULL,
	ServiceFeePercentage decimal(5, 2) NOT NULL,
	PaymentProcessingFeePercentage decimal(5, 2) NULL,
	PaymentProcessingFeeFixed decimal(5, 2) NULL
	)  ON [PRIMARY]
GO
ALTER TABLE dbo.Tmp_bookingtype SET (LOCK_ESCALATION = TABLE)
GO
ALTER TABLE dbo.Tmp_bookingtype ADD CONSTRAINT
	DF__bookingty__Servi__2215F810 DEFAULT ((0)) FOR ServiceFeeFixed
GO
ALTER TABLE dbo.Tmp_bookingtype ADD CONSTRAINT
	DF__bookingty__Servi__230A1C49 DEFAULT ((0)) FOR ServiceFeePercentage
GO
ALTER TABLE dbo.Tmp_bookingtype ADD CONSTRAINT
	DF__bookingty__Payme__23FE4082 DEFAULT ((0)) FOR PaymentProcessingFeePercentage
GO
IF EXISTS(SELECT * FROM dbo.bookingtype)
	 EXEC('INSERT INTO dbo.Tmp_bookingtype (BookingTypeID, BookingTypeName, BookingTypeDescription, CreatedDate, UpdatedDate, ModifiedBy, Active, ServiceFeeFixed, ServiceFeePercentage, PaymentProcessingFeePercentage)
		SELECT BookingTypeID, BookingTypeName, BookingTypeDescription, CreatedDate, UpdatedDate, ModifiedBy, Active, CONVERT(decimal(3, 2), ServiceFeeCurrency), CONVERT(decimal(3, 2), ServiceFeePercentage), PaymentProcessingFee FROM dbo.bookingtype WITH (HOLDLOCK TABLOCKX)')
GO
ALTER TABLE dbo.bookingrequest
	DROP CONSTRAINT FK__bookingre__Booki__5A1A5A11
GO
DROP TABLE dbo.bookingtype
GO
EXECUTE sp_rename N'dbo.Tmp_bookingtype', N'bookingtype', 'OBJECT' 
GO
ALTER TABLE dbo.bookingtype ADD CONSTRAINT
	PK__bookingt__649EC4B15090EFD7 PRIMARY KEY CLUSTERED 
	(
	BookingTypeID
	) WITH( STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]

GO
COMMIT
select Has_Perms_By_Name(N'dbo.bookingtype', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.bookingtype', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.bookingtype', 'Object', 'CONTROL') as Contr_Per BEGIN TRANSACTION
GO
ALTER TABLE dbo.bookingrequest ADD CONSTRAINT
	FK__bookingre__Booki__5A1A5A11 FOREIGN KEY
	(
	BookingTypeID
	) REFERENCES dbo.bookingtype
	(
	BookingTypeID
	) ON UPDATE  NO ACTION 
	 ON DELETE  NO ACTION 
	
GO
ALTER TABLE dbo.bookingrequest SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.bookingrequest', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.bookingrequest', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.bookingrequest', 'Object', 'CONTROL') as Contr_Per 