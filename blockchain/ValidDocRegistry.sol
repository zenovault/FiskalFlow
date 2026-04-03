// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ValidDocRegistry {
    struct Document {
        string docHash;
        string docType;
        uint256 timestamp;
        address submittedBy;
    }

    mapping(string => Document) private documents;
    event DocumentStored(string indexed docHash, string docType,
                         uint256 timestamp, address submittedBy);

    function storeDocument(string memory docHash,
                           string memory docType) external {
        require(bytes(documents[docHash].docHash).length == 0,
                "Document already registered");
        documents[docHash] = Document(
            docHash, docType, block.timestamp, msg.sender
        );
        emit DocumentStored(docHash, docType,
                            block.timestamp, msg.sender);
    }

    function verifyDocument(string memory docHash)
        external view returns (bool exists, uint256 timestamp,
                               string memory docType) {
        Document memory doc = documents[docHash];
        return (
            bytes(doc.docHash).length > 0,
            doc.timestamp,
            doc.docType
        );
    }
}
